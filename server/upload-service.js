const { v4: uuidv4 } = require('uuid');
const cloudinary = require('./cloudinary');

const FOLDER_PREFIX = process.env.CLOUDINARY_FOLDER_PREFIX || 'cabanero-dev';

const ALLOWED_TYPES = ['receipt', 'venue', 'plan', 'deposit', 'inventory', 'maintenance'];

async function uploadImage(fileBuffer, { type, mimetype }) {
  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error(`Tipo de upload no válido: ${type}. Permitidos: ${ALLOWED_TYPES.join(', ')}`);
  }

  const id = uuidv4();
  const folder = `${FOLDER_PREFIX}/${type}s`;
  const publicId = `${folder}/${id}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'image',
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(fileBuffer);
  });
}

async function deleteImage(publicId) {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId);
}

function extractPublicId(url) {
  if (!url || !url.includes('cloudinary')) return null;
  // URL format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}.{ext}
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
  return match ? match[1] : null;
}

module.exports = { uploadImage, deleteImage, extractPublicId };
