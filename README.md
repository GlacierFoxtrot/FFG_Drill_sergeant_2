# ⚔️ Bot FFG – Gestion des rôles & Guerres

Bot Discord pour gérer les vérifications de membres et les annonces de guerre.

---

## 🎯 Fonctionnalités

### Commande `/verif @utilisateur`
Réservée aux **Officiers**. Le bot propose ensuite des menus :

**Type FFG** → Tag `[FFG]` + un de ces rôles :
- `recrue`
- `soldat`
- `sous-officier` *(protégé de la purge)*

**Type Personnalisé / Coalition** :
- `allié` → tag personnalisé
- `mercenaire` → tag personnalisé
- `Membre de Coalition` → tag fixe `[WCI]` *(protégé de la purge)*

### Bouton rouge « Vérification des soldats »
- Retire les rôles : `recrue`, `soldat`, `allié`, `mercenaire`
- Retire le tag `[...]` du pseudo
- Les anciennes **recrues** et **soldats** reçoivent le rôle **réserviste**
- Envoie un message bilingue (FR + EN) dans le salon de notification
- **Protégés (jamais touchés)** : `Officier`, `sous-officier`, `Membre de Coalition`

### Bouton vert « Nouvelle guerre »
- Demande le numéro X
- Envoie `-- War X --` dans les salons configurés

### Configuration des salons
- Boutons du panneau ou commande `/config-guerre`

---

## 📋 Rôles nécessaires sur le serveur

| Rôle                  | Utilisation                                      | Protégé de la purge |
|-----------------------|--------------------------------------------------|---------------------|
| `Officier`            | Peut utiliser toutes les commandes/boutons       | Oui                 |
| `sous-officier`       | Grade FFG intermédiaire                          | Oui                 |
| `recrue`              | Membres FFG débutants                            | Non                 |
| `soldat`              | Membres FFG confirmés                            | Non                 |
| `allié`               | Alliés                                           | Non                 |
| `mercenaire`          | Mercenaires                                       | Non                 |
| `Membre de Coalition` | Membres de la coalition (tag [WCI])              | Oui                 |
| `réserviste`          | Anciennes recrues/soldats après purge            | -                   |

> **Important** : le rôle du bot doit être **au-dessus** de tous ces rôles.

---

## 🚀 Installation

### 1. Créer le bot Discord
1. Va sur https://discord.com/developers/applications
2. **New Application** → nomme-le
3. Onglet **Bot** → Add Bot → Reset Token (copie le token)
4. Active **Server Members Intent**
5. Onglet **OAuth2 → URL Generator**
   - Scopes : `bot` + `applications.commands`
   - Permissions : Manage Roles, Manage Nicknames, Send Messages, Embed Links, Read Message History, View Channels, Use Application Commands
6. Invite le bot avec le lien généré

### 2. Récupérer les IDs
- **Client ID** : OAuth2 → General
- **Guild ID** : Clic droit sur le serveur (Mode développeur) → Copier l’identifiant

### 3. Lancer le bot

```bash
cd ffg-bot
npm install
```

Crée un fichier `.env` :

```env
DISCORD_TOKEN=ton_token
CLIENT_ID=ton_client_id
GUILD_ID=id_de_ton_serveur
```

Puis :

```bash
npm run register
npm start
```

### 4. Hébergement 24/7
**Railway.app** : New Project → Deploy from GitHub (ou CLI) → ajoute les 3 variables d’environnement.

---

## 🎮 Utilisation

1. `/panel` → envoie le panneau permanent
2. Configure le **salon de notification** et les **salons de guerre**
3. `/verif @pseudo` pour vérifier un membre
4. Utilise les boutons selon les besoins

---

## ❓ Problèmes courants

| Problème | Solution |
|---------|----------|
| Le bot ne change pas les rôles/pseudos | Son rôle doit être plus haut que les rôles qu’il gère |
| Les commandes n’apparaissent pas | Relance `npm run register` avec le bon `GUILD_ID` |
| Erreur de permissions | Vérifie les permissions du bot dans le salon |
