import mongoose from "mongoose";
import { env } from "../config/env.js";

let connectionPromise;

export const connectToDatabase = async () => {
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
  }

  return connectionPromise;
};
