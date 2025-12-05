import {model, Schema} from 'mongoose'

const userSchema = new Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0.00
  }
}, { timestamps: true });

// Instance method to deposit money
// userSchema.methods.deposit = async (amount) {
//   if (amount <= 0) {
//     throw new Error('Deposit amount must be greater than zero.');
//   }
//   this.balance += amount;
//   return this.save();
//   await Transaction.create({ userId: this._id, type: 'deposit', amount });
// };

// // Instance method for withdrawing money
// userSchema.methods.withdraw = async (amount) {
//   if (amount <= 0) {
//     throw new Error('Withdrawal amount must be greater than zero.');
//   }
//   if (amount > this.balance) {
//     throw new Error('Insufficient balance.');
//   }
//   this.balance -= amount;
//   return this.save();
//   await Transaction.create({ userId: this._id, type: 'withdrawal', amount });
// };

const User = model('User', userSchema)
export default User