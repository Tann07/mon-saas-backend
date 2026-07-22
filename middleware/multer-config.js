const multer = require('multer');
const path = require('path');

const MIME_TYPES = {
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/webm': 'webm',
  'video/3gpp': 'mp4'
};

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, 'uploads');
  },
  filename: (req, file, callback) => {
    const extOriginale = path.extname(file.originalname).replace('.', '').toLowerCase();
    const extension = MIME_TYPES[file.mimetype] || extOriginale || 'mp4';
    const name = file.originalname.split(' ').join('_').split('.')[0];
    callback(null, `${name}_${Date.now()}.${extension}`);
  }
});

module.exports = multer({ storage: storage }).array('image', 10);