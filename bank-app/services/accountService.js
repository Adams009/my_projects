import User from '#models/userModel.js';
import Transaction from '#models/transactionModel.js';
import Decimal from 'decimal.js';

class AccountService {
    async deposit(userId, amount) {
        const value = new Decimal(amount);
        if (value.lte(0)) {
            throw new Error('Deposit amount must be greater than zero.');
        }

        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found.');
        }

        user.balance = new Decimal(user.balance).plus(value).toDecimalPlaces(2).toNumber();
        await user.save();
        await Transaction.create({ userId: user._id, type: 'deposit', amount: value.toNumber() });

        return {
            status: 'success',
            data: {
                balance: user.balance.toFixed(2)
            }
        };
    }

    async withdraw(userId, amount) {
        const value = new Decimal(amount);
        if (value.lte(0)) {
            throw new Error('Withdrawal amount must be greater than zero.');
        }

        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found.');
        }

        if (new Decimal(user.balance).lt(value)) {
            throw new Error('Insufficient balance.');
        }

        user.balance = new Decimal(user.balance).minus(value).toDecimalPlaces(2).toNumber();

        await user.save();
        await Transaction.create({ userId: user._id, type: 'withdrawal', amount: value.toNumber() });

        return {
            status: 'success',
            data: {
                balance: user.balance.toFixed(2)
            }
        };
    }

    async getBalance(userId) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found.');
        }
        return {
            status: 'success',
            data: {
                balance: user.balance.toFixed(2)
            }
        };
    }
}

export default AccountService