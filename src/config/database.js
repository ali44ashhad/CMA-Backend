import mongoose from 'mongoose';

// Track the connection globally for serverless environments (e.g., Vercel)
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI is not set');
        }

        const options = {
            serverSelectionTimeoutMS: 15000,
            bufferCommands: false, // Prevent mongoose from buffering commands when disconnected
        };

        cached.promise = mongoose.connect(uri, options).then((mongoose) => {
            console.log(`MongoDB Connected: ${mongoose.connection.host}`);
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        console.error(`MongoDB connection error: ${e.message}`);
        throw e;
    }

    return cached.conn;
};

export default connectDB;
