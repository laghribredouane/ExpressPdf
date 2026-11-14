# Spécification de Sécurité Firestore — PDFExpress Cloud History

## 1. Invariants de Données (Data Invariants)
1. **Propriété stricte** : Un document sous `/users/{userId}` ou ses sous-collections ne peut être lu ou écrit que par l'utilisateur authentifié et vérifié dont `request.auth.uid == userId`.
2. **Intégrité relationnelle** : Toute entrée dans `/users/{userId}/history/{entryId}` requiert l'existence du document parent `/users/{userId}` avec `uid == request.auth.uid`.
3. **Isolation des données personnelles (PII)** : L'adresse e-mail est isolée dans `/users/{userId}/private/info` et jamais exposée dans des requêtes publiques ou multi-utilisateurs.
4. **Immuabilité et horodatage serveur** : `uid`, `userId`, `id` et `createdAt` sont immuables après création et `createdAt` / `updatedAt` doivent correspondre strictement à `request.time`.
5. **Contraintes volumétriques et de clés** : Chaque document valide strictement les clés autorisées (`hasAll` + `hasOnly`), les longueurs de chaînes et le format des identifiants (`^[a-zA-Z0-9_\-]+$`).

## 2. "Dirty Dozen" Payloads de Test
1. **Usurpation d'identité à la création d'historique** : `{ userId: "victim-uid", id: "entry1", ... }` soumis par `attacker-uid` -> **PERMISSION_DENIED**.
2. **Élévation de privilèges (champ fantôme)** : `{ uid: "user1", displayName: "Test", isAdmin: true, ... }` -> **PERMISSION_DENIED** (`keys().hasOnly`).
3. **Écriture sans vérification e-mail** : Requête avec `request.auth.token.email_verified == false` -> **PERMISSION_DENIED**.
4. **Falsification d'horodatage client** : `{ ..., createdAt: "2020-01-01T00:00:00Z" }` au lieu de `request.time` -> **PERMISSION_DENIED**.
5. **Modification d'un champ immuable** : Mise à jour modifiant `createdAt` ou `userId` sur une entrée existante -> **PERMISSION_DENIED**.
6. **Injection d'ID surdimensionné (>128 caractères)** : Document ID de 2000 caractères sur `create`/`get` -> **PERMISSION_DENIED** (`isValidId`).
7. **Injection de caractères spéciaux dans l'ID** : ID `entry$bad/path` -> **PERMISSION_DENIED** (`matches('^[a-zA-Z0-9_\\-]+$')`).
8. **Dépassement volumétrique de chaîne (`fileName` > 255 car.)** : `{ fileName: "a".repeat(300) }` -> **PERMISSION_DENIED**.
9. **Lecture transversale de PII** : `userA` tente `get` sur `/users/userB/private/info` -> **PERMISSION_DENIED**.
10. **Énumération globale des utilisateurs** : Requête `list` sur `/users` -> **PERMISSION_DENIED**.
11. **Création d'historique orphelin sans profil parent** : Écriture dans `/users/userA/history/h1` avant création de `/users/userA` -> **PERMISSION_DENIED**.
12. **Écriture non authentifiée** : `request.auth == null` sur toute collection -> **PERMISSION_DENIED**.
