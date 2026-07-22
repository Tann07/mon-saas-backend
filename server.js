const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const userRoutes = require('./routes/userRoutes'); 
const photoRoutes = require('./routes/photoRoutes');
const albumRoutes = require('./routes/albumRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// 🎬 ROUTE DE STREAMING VIDÉO HTTP 206 (Gestion du scrubbing et CORS)
app.get('/uploads/:filename', (req, res, next) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Fichier introuvable");
    }

    const ext = path.extname(req.params.filename).toLowerCase();
    
    // Si c'est une image, express.static prend le relais
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
        return next();
    }

    // Gestion du streaming vidéo HTTP 206
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize) {
            res.status(416).send('Plage demandée non satisfaisable\n' + start + ' >= ' + fileSize);
            return;
        }

        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': ext === '.mov' ? 'video/quicktime' : 'video/mp4',
        };

        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': ext === '.mov' ? 'video/quicktime' : 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

// Dossiers statiques
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static('public'));

mongoose.connect('mongodb://127.0.0.1:27017/monProjetPhoto')
  .then(() => console.log('✅ Connecté à MongoDB avec succès !'))
  .catch((err) => console.error('❌ Erreur de connexion à MongoDB :', err));

app.use('/api/auth', userRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/albums', albumRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur Média & Streaming vidéo accessible sur http://0.0.0.0:${PORT}`);
});