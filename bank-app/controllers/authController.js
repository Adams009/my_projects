import AuthService from "#services/authService.js";

class AuthController {
    constructor() {
        this.authService = new AuthService();
    }

    async register(req, res) {
        try {
            const {data} = await this.authService.register(req.body);
            return res.status(201).json({
                status: 'success',
                message: 'User registered successfully.',
                data: {
                    id: data.id,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    accountNumber: data.accountNumber
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async login(req, res) {
        try {
            const {data} = await this.authService.login(req.body);
            res.cookie('refreshToken', data.refreshToken, {
                httpOnly: true,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Lax',
            })
            return res.status(200).json({
                status: 'success',
                message: 'Login successful.',
                data: {
                    accessToken: data.accessToken,
                    id: data.id
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async refreshToken(req, res) {
        try {
            const {data} = await this.authService.refreshToken(req.cookies.refreshToken);
            res.cookie('refreshToken', data.newRefreshToken, {
                httpOnly: true,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Lax',
            })
            return res.status(200).json({
                status: 'success',
                message: 'Token refreshed successfully.',
                data: {
                    accessToken: data.newAccessToken,
                    id: data.id
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default AuthController;