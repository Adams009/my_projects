import {Schema, model} from 'mongoose'

const transactionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Transaction = model('Transaction', transactionSchema);

export default Transaction;