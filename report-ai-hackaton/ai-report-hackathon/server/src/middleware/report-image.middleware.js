import { fileTypeFromBuffer } from "file-type";
import multer from "multer";

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
    fields: 10,
    parts: 15,
  },
  fileFilter(_request, file, callback) {
    if (!allowedImageTypes.has(file.mimetype)) {
      const error = new Error("Only JPEG, PNG, and WebP images are allowed.");
      error.code = "INVALID_IMAGE_TYPE";
      callback(error);
      return;
    }

    callback(null, true);
  },
});

export function uploadReportImages(request, response, next) {
  imageUpload.array("images", 5)(request, response, async (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        const message =
          error.code === "LIMIT_FILE_SIZE"
            ? "Each image must be 5 MB or smaller."
            : error.code === "LIMIT_FILE_COUNT" ||
                error.code === "LIMIT_UNEXPECTED_FILE"
              ? "You can upload up to 5 images."
              : "Unable to process the uploaded images.";

        response.status(400).json({
          status: "error",
          message,
        });
        return;
      }

      if (error.code === "INVALID_IMAGE_TYPE") {
        response.status(400).json({
          status: "error",
          message: error.message,
        });
        return;
      }

      next(error);
      return;
    }

    const files = request.files || [];

    try {
      const detectedTypes = await Promise.all(
        files.map((file) => fileTypeFromBuffer(file.buffer)),
      );

      const hasInvalidImage = detectedTypes.some(
        (detectedType, index) =>
          !detectedType ||
          !allowedImageTypes.has(detectedType.mime) ||
          detectedType.mime !== files[index].mimetype,
      );

      if (hasInvalidImage) {
        response.status(400).json({
          status: "error",
          message: "Each uploaded file must be a valid JPEG, PNG, or WebP image.",
        });
        return;
      }

      next();
    } catch (validationError) {
      next(validationError);
    }
  });
}