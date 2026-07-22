const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
    titre: {
        type: String,
        default: "",
    },
    description: {
        type: String,
        default: ""
    },
    urlImage: {
        type: String,
        required: true // Le lien de l'image (local ou internet)
    },
    typeMedia: { type: String, enum: ['image', 'video'], default: 'image' }, // 👈 Distingue photo et vidéo
    
    dateAjout: {
        type: Date,
        default: Date.now
    },
    // 🔑 On ajoute le lien vers l'album !
    album: { type: mongoose.Schema.Types.ObjectId, ref: 'Album', required: true },
    
    // 🏷️ On ajoute les tags pour le tri intelligent
    tags: [{ type: String }],

    suggestionInstagram: { type: String, default: "" }, // 👈 À AJOUTER POUR L'IA MISTRA

    dateCreation: { type: Date, default: Date.now }


});

module.exports = mongoose.models.Photo || mongoose.model('Photo', photoSchema);