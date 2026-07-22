const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        // 1. On récupère le token dans l'entête de la requête
        const token = req.headers.authorization.split(' ')[1];
        
        // 2. On décode le token avec notre clé secrète
        const decodedToken = jwt.verify(token, 'NOTRE_CLE_SECRETE_SUPER_CACHEE');
        
        // 3. On extrait l'ID (on gère s'il a été stocké dans .id ou .userId)
        const userId = decodedToken.userId || decodedToken.id;

        if (!userId) {
            throw 'ID utilisateur manquant dans le token';
        }

        // 4. 🛠️ UNIVERSEL : On injecte l'ID partout où les routes peuvent le chercher !
        req.auth = { userId: userId };
        req.user = { id: userId };

        next(); // On laisse passer la requête vers la route
    } catch (error) {
        console.error("❌ ÉCHEC AUTHENTIFICATION MIDDLEWARE :", error);
        res.status(401).json({ message: 'Requête non authentifiée !' });
    }
};