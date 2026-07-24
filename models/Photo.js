const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    auteur: { type: String, required: true },
    auteurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    texte: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

const photoSchema = new mongoose.Schema({
    titre: { type: String },
    description: { type: String },
    urlImage: { type: String, required: true },
    typeMedia: { type: String, enum: ['image', 'video'], default: 'image' },
    album: { type: mongoose.Schema.Types.ObjectId, ref: 'Album' },
    tags: [{ type: String }],
    suggestionInstagram: { type: String },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Liste des users ayant liké
    commentaires: [commentSchema] // Liste des commentaires
}, { timestamps: true });

module.exports = mongoose.model('Photo', photoSchema);