import mongoose from "mongoose";
// Token blacklist schema (Revoked tokens)
const revokedTokenSchema = new mongoose.Schema({
    token: { type: String, required: true },
    // revokedAt: { type: Date, required: true },
    // expiresAt: { type: Date, required: true }, // Expiry date of the token
    createdAt: { type: Date, default: Date.now(), expires: '7d' }, // Automatically delete the document after 7 days
  });

  export default mongoose.model('RevokedToken', revokedTokenSchema);