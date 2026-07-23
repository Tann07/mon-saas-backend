const mongoose = require('mongoose');

// On efface l'ancien modèle en mémoire s'il existe déjà
if (mongoose.models.Album) {
    delete mongoose.models.Album;
}

const albumSchema = new mongoose.Schema({
    titre: { type: String, required: true },
    description: { type: String },
    createur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // 📁 Champ indispensable pour l'arborescence
    parentAlbum: { type: mongoose.Schema.Types.ObjectId, ref: 'Album', default: null },

    // 🌐 Sécurité & Partage
    statut: { type: String, default: "prive" },
    codePartage: { type: String, unique: true, sparse: true },
    codePIN: { type: String, default: "" },
    
    // 🎨 Visuel & Collaboration
    photoCouverture: { type: String, default: "" },
    accesAutorises: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Album', albumSchema);