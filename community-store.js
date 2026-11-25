// Comunidade do Moto KM: armazenamento.
//
// As telas só falam com `window.CommunityStore`, sempre por funções assíncronas (Promises).
// Nesta etapa tudo fica no aparelho, num IndexedDB próprio ("motokm-comunidade"), separado das
// viagens, recargas e ajustes (que continuam no localStorage "motokm:v1"). As fotos ficam no
// IndexedDB porque não cabem no localStorage.
//
// Para ligar num banco de dados depois, basta criar outra implementação com as mesmas funções
// (por exemplo createRemoteCommunityStore com Supabase/Firebase) e trocar a linha no fim do
// arquivo. As telas não mudam. O modelo já é o de um banco:
//
//   profiles  { id, name, handle, test, color }
//   posts     { id, authorId, caption, createdAt, photoId|null, trip|null }
//             trip = cópia da viagem publicada { tripId, start, end, km, movingSec, maxKmh, route, breaks? }
//             (o histórico continua separado: apagar uma viagem não apaga o post, e vice-versa)
//   photos    { id, type, data(ArrayBuffer) }            → no servidor: arquivo no storage, com URL
//   likes     { id: postId|profileId, postId, profileId, createdAt }
//   messages  { id, convId, fromId, toId, text, createdAt, readAt|null }
//             convId = os dois ids de perfil em ordem alfabética, ligados por "|"
(function () {
  'use strict';

  const TEST_PROFILES = [
    { id: 'teste-a', name: 'Piloto A', handle: 'piloto_a', test: true, color: '#B6F04A' },
    { id: 'teste-b', name: 'Piloto B', handle: 'piloto_b', test: true, color: '#60A5FA' }
  ];

  const newId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const convIdOf = (a, b) => [a, b].sort().join('|');

  function createLocalCommunityStore(dbName = 'motokm-comunidade') {
    let dbP = null;
    const photoUrls = new Map(); // photoId -> object URL (reaproveitado entre telas)

    function open() {
      if (dbP) return dbP;
      dbP = new Promise((ok, no) => {
        if (!('indexedDB' in window)) { no(new Error('Este navegador não guarda dados da Comunidade')); return; }
        const rq = indexedDB.open(dbName, 1);
        rq.onupgradeneeded = () => {
          const db = rq.result;
          db.createObjectStore('profiles', { keyPath: 'id' });
          db.createObjectStore('posts', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
          db.createObjectStore('photos', { keyPath: 'id' });
          db.createObjectStore('likes', { keyPath: 'id' }).createIndex('postId', 'postId');
          db.createObjectStore('messages', { keyPath: 'id' }).createIndex('convId', 'convId');
        };
        rq.onsuccess = () => ok(rq.result);
        rq.onerror = () => no(rq.error);
      }).then(async db => {
        const have = await all(db, 'profiles');
        if (!have.length) await tx(db, ['profiles'], 'readwrite', s => TEST_PROFILES.forEach(p => s.profiles.put(p)));
        return db;
      }).catch(e => { dbP = null; throw e; });
      return dbP;
    }
    // Uma transação: fn recebe { nomeDaStore: objectStore } e pode guardar o resultado em out.v.
    function tx(db, names, mode, fn) {
      return new Promise((ok, no) => {
        const t = db.transaction(names, mode), stores = {}, out = {};
        names.forEach(n => stores[n] = t.objectStore(n));
        fn(stores, out);
        t.oncomplete = () => ok(out.v);
        t.onerror = () => no(t.error);
        t.onabort = () => no(t.error || new Error('abortado'));
      });
    }
    const req = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
    const all = (db, store) => req(db.transaction(store).objectStore(store).getAll());
    const byIndex = (db, store, index, key) => req(db.transaction(store).objectStore(store).index(index).getAll(key));

    return {
      kind: 'local',

      async listProfiles() { return all(await open(), 'profiles'); },

      // Feed do mais novo para o mais antigo, já com autor e curtidas do ponto de vista de quem vê.
      async listFeed({ viewerId } = {}) {
        const db = await open();
        const [posts, profiles, likes] = await Promise.all([all(db, 'posts'), all(db, 'profiles'), all(db, 'likes')]);
        const prof = Object.fromEntries(profiles.map(p => [p.id, p]));
        return posts.sort((a, b) => b.createdAt - a.createdAt).map(p => {
          const ls = likes.filter(l => l.postId === p.id);
          return { ...p, author: prof[p.authorId] || { id: p.authorId, name: 'Perfil removido' }, likeCount: ls.length, likedByMe: ls.some(l => l.profileId === viewerId) };
        });
      },

      // photo: Blob (já reduzido pela tela) ou null; trip: cópia da viagem ou null. Precisa de um dos dois.
      async createPost({ authorId, caption = '', photo = null, trip = null }) {
        if (!photo && !trip) throw new Error('O post precisa de uma foto ou de um trajeto');
        const db = await open();
        const data = photo ? await photo.arrayBuffer() : null;
        const post = { id: newId(), authorId, caption: String(caption).slice(0, 2200), createdAt: Date.now(), photoId: photo ? newId() : null, trip };
        await tx(db, ['posts', 'photos'], 'readwrite', s => {
          if (photo) s.photos.put({ id: post.photoId, type: photo.type || 'image/jpeg', data });
          s.posts.put(post);
        });
        return post;
      },

      async deletePost(postId, byProfileId) {
        const db = await open();
        const post = await req(db.transaction('posts').objectStore('posts').get(postId));
        if (!post) return;
        if (post.authorId !== byProfileId) throw new Error('Só quem publicou pode apagar');
        const likes = await byIndex(db, 'likes', 'postId', postId);
        await tx(db, ['posts', 'photos', 'likes'], 'readwrite', s => {
          s.posts.delete(postId);
          if (post.photoId) s.photos.delete(post.photoId);
          likes.forEach(l => s.likes.delete(l.id));
        });
      },

      // Endereço para mostrar a foto num <img>. No servidor seria a URL pública do arquivo.
      async photoUrl(photoId) {
        if (!photoId) return null;
        if (photoUrls.has(photoId)) return photoUrls.get(photoId);
        const ph = await req((await open()).transaction('photos').objectStore('photos').get(photoId));
        if (!ph) return null;
        const url = URL.createObjectURL(new Blob([ph.data], { type: ph.type }));
        photoUrls.set(photoId, url);
        return url;
      },

      // Curtir (liked = true) ou descurtir. Devolve o estado e o total atualizados.
      async setLike(postId, profileId, liked) {
        const db = await open(), id = postId + '|' + profileId;
        await tx(db, ['likes'], 'readwrite', s => liked ? s.likes.put({ id, postId, profileId, createdAt: Date.now() }) : s.likes.delete(id));
        const ls = await byIndex(db, 'likes', 'postId', postId);
        return { liked, count: ls.length };
      },

      // Caixa de entrada: uma linha por conversa, a mais recente em cima.
      async listConversations(profileId) {
        const db = await open();
        const [msgs, profiles] = await Promise.all([all(db, 'messages'), all(db, 'profiles')]);
        const prof = Object.fromEntries(profiles.map(p => [p.id, p])), conv = new Map();
        for (const m of msgs) {
          if (m.fromId !== profileId && m.toId !== profileId) continue;
          const otherId = m.fromId === profileId ? m.toId : m.fromId;
          const c = conv.get(m.convId) || { convId: m.convId, other: prof[otherId] || { id: otherId, name: 'Perfil removido' }, last: null, unread: 0 };
          if (!c.last || m.createdAt > c.last.createdAt) c.last = m;
          if (m.toId === profileId && !m.readAt) c.unread++;
          conv.set(m.convId, c);
        }
        return [...conv.values()].sort((a, b) => b.last.createdAt - a.last.createdAt);
      },

      async listMessages(profileId, otherId) {
        const ms = await byIndex(await open(), 'messages', 'convId', convIdOf(profileId, otherId));
        return ms.sort((a, b) => a.createdAt - b.createdAt);
      },

      async sendMessage(fromId, toId, text) {
        text = String(text).trim().slice(0, 2000);
        if (!text) throw new Error('Mensagem vazia');
        if (fromId === toId) throw new Error('Escolha outro perfil');
        const m = { id: newId(), convId: convIdOf(fromId, toId), fromId, toId, text, createdAt: Date.now(), readAt: null };
        await tx(await open(), ['messages'], 'readwrite', s => s.messages.put(m));
        return m;
      },

      async markRead(profileId, otherId) {
        const db = await open(), now = Date.now();
        const ms = (await byIndex(db, 'messages', 'convId', convIdOf(profileId, otherId))).filter(m => m.toId === profileId && !m.readAt);
        if (ms.length) await tx(db, ['messages'], 'readwrite', s => ms.forEach(m => s.messages.put({ ...m, readAt: now })));
      },

      async unreadCount(profileId) {
        const ms = await all(await open(), 'messages');
        return ms.filter(m => m.toId === profileId && !m.readAt).length;
      },

      // Apaga posts, fotos, curtidas e mensagens de teste (os perfis de teste continuam).
      async clearAll() {
        await tx(await open(), ['posts', 'photos', 'likes', 'messages'], 'readwrite', s => Object.values(s).forEach(st => st.clear()));
        photoUrls.forEach(u => URL.revokeObjectURL(u)); photoUrls.clear();
      }
    };
  }

  window.createLocalCommunityStore = createLocalCommunityStore;
  // Troque esta linha para usar um banco de dados online, mantendo as mesmas funções.
  window.CommunityStore = createLocalCommunityStore();
})();
