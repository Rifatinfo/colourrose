

import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(), // 🔥 important
  limits: {
    files: 4,
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

export const fileUploader = { upload };
