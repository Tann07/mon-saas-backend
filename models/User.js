const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },       // Pour l'inscription (register)
    motDePasse: { type: String },                     // Sécurité pour ta connexion (login)
    forfait: { type: String, default: "Gratuit" },    // Formule SaaS
    stockageMaxMo: { type: Number, default: 15360 }   // Espace de stockage
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);