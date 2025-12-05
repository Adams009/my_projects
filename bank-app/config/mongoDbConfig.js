import mongoose from 'mongoose';
import config from './envConfig.js';

const mongoConnect = async () => {
    try {
        await mongoose.connect(config.mongoDbUrl);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.log('Error connecting to MongoDB', error);
    }
}
export default mongoConnect;