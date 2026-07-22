const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema({
    titre: { type: String, required: true },
    description: { type: String },
    createur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 🌐 Sécurité & Partage
    statut: { type: String, default: "prive" }, // "prive" ou "public"
    codePartage: { type: String, unique: true, sparse: true }, // Identifiant unique pour le lien de partage
    // 🔐 Code de sécurité optionnel pour les invités
    codePIN: { type: String, default: "" }, // Si vide = pas de mot de passe, si rempli = accès verrouillé
    // 🎨 Personnalisation visuelle
    photoCouverture: { type: String, default: "" }, // Contiendra l'URL de l'image de couverture
    // 👥协作 / Mode Drive : Liste des utilisateurs invités à consulter cet album
    accesAutorises: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

module.exports = mongoose.models.Album || mongoose.model('Album', albumSchema);