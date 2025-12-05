import AccountService from "#services/accountService.js";

class AccountController {
    constructor() {
        this.accountService = new AccountService();
    }

    async getBalance(req, res) {
        try {
            const { userId } = req.params;
            const { data } = await this.accountService.getBalance(userId);
            return res.status(200).json({
                status: 'success',
                message: 'Balance retrieved successfully.',
                data: {
                    balance: data.balance
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        };
    }

    async deposit(req, res) {
        try {
            const { userId } = req.params;
            const { amount } = req.body;
            const { data } = await this.accountService.deposit(userId, amount);
            return res.status(200).json({
                status: 'success',
                message: 'Deposit successful.',
                data: {
                    balance: data.balance
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async withdraw(req, res) {
        try {
            const { userId } = req.params;
            const { amount } = req.body;
            const { data } = await this.accountService.withdraw(userId, amount);
            return res.status(200).json({
                status: 'success',
                message: 'Withdrawal successful.',
                data: {
                    balance: data.balance
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default AccountController;