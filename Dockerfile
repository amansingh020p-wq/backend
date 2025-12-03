# Use Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy dependency files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the code
COPY . .

# Expose port
EXPOSE 5000

# Start the app (FIXED THIS LINE)
CMD ["npm", "run", "dev"]
