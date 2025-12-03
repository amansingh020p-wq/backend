import dotenv from "dotenv"
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables FIRST before importing anything else
// Use absolute path to ensure .env is found regardless of where server is started
const envPath = join(__dirname, '../.env');
console.log("Loading environment from:", envPath);

// Check if .env file exists
if (!existsSync(envPath)) {
    console.error("❌ .env file NOT FOUND at:", envPath);
    console.error("Please create a .env file in the Server directory");
} else {
    console.log("✓ .env file exists at:", envPath);
    
    // Read and show .env file content (for debugging - hide sensitive values)
    try {
        const envContent = readFileSync(envPath, 'utf8');
        console.log("\n📄 .env file contents (first 500 chars):");
        const lines = envContent.split('\n').slice(0, 10); // Show first 10 lines
        lines.forEach((line, index) => {
            if (line.trim() && !line.startsWith('#')) {
                // Hide password values
                const masked = line.replace(/(EMAIL_PASS|PASSWORD)=.*/gi, (match) => {
                    const [key] = match.split('=');
                    return `${key}=***hidden***`;
                });
                console.log(`  Line ${index + 1}: ${masked}`);
            }
        });
        
        // Check for email variables in file
        const hasEmailUser = /EMAIL_USER\s*=/i.test(envContent);
        const hasEmailFrom = /EMAIL_FROM\s*=/i.test(envContent);
        const hasEmailPass = /EMAIL_PASS\s*=/i.test(envContent);
        const hasEmailService = /EMAIL_SERVICE\s*=/i.test(envContent);
        
        console.log("\n🔍 Email variables found in .env file:");
        console.log(`  EMAIL_USER: ${hasEmailUser ? '✓ Found' : '✗ Missing'}`);
        console.log(`  EMAIL_FROM: ${hasEmailFrom ? '✓ Found' : '✗ Missing'}`);
        console.log(`  EMAIL_PASS: ${hasEmailPass ? '✓ Found' : '✗ Missing'}`);
        console.log(`  EMAIL_SERVICE: ${hasEmailService ? '✓ Found' : '✗ Missing'}`);
    } catch (error) {
        console.error("Error reading .env file:", error.message);
    }
}

// Debug: Show what env vars are actually loaded
console.log("\n📦 Loading environment variables with dotenv...");
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.error("❌ Error loading .env file:", result.error);
} else {
    console.log("✓ dotenv.config() executed");
    if (result.parsed) {
        console.log(`  Parsed ${Object.keys(result.parsed).length} variables`);
    }
}

// Show all process.env keys that start with EMAIL
const emailEnvVars = Object.keys(process.env)
    .filter(key => key.startsWith('EMAIL'))
    .reduce((obj, key) => {
        obj[key] = process.env[key] ? (key.includes('PASS') ? '***hidden***' : process.env[key]) : 'not set';
        return obj;
    }, {});

console.log("Email-related environment variables:", emailEnvVars);
console.log("Environment variables loaded:", {
    PORT: process.env.PORT ? "✓" : "✗",
    MONGODB_URI: process.env.MONGODB_URI ? "✓" : "✗",
    EMAIL_USER: process.env.EMAIL_USER || "not set",
    EMAIL_FROM: process.env.EMAIL_FROM || "not set",
    EMAIL_PASS: process.env.EMAIL_PASS ? "✓ (hidden)" : "✗",
    EMAIL_SERVICE: process.env.EMAIL_SERVICE || "not set"
});

// Now import after env vars are loaded
import app from './app.js'
import connectDB from "./db/index.js";

console.log("Port : ", process.env.PORT)

connectDB()
.then(()=>{
    app.listen(process.env.PORT ,()=>{
        console.log(`Server is listening on port : ${process.env.PORT}`);

    })
})
.catch((error)=>{
    console.error("Mongoose connection failed",error)
})