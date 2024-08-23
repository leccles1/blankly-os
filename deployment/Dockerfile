ARG BASE_IMAGE=google/cloud-sdk:slim
FROM ${BASE_IMAGE}

ARG NODE_VERSION=16
# Set the user and working directory
USER root
WORKDIR /home/app

# Install dependencies and tools in one layer
RUN apt-get update && \
    curl -sL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install -y nodejs kubectl google-cloud-sdk-gke-gcloud-auth-plugin && \
    rm -rf /var/lib/apt/lists/*

# Copy package files and install node modules
COPY package.json tsconfig.json /home/app/
COPY ./blankly-dev.json /home/app/
RUN npm install

# Set environment variable
ENV NODE_ENV=production
ENV GOOGLE_APPLICATION_CREDENTIALS=/home/app/blankly-dev.json
# Copy the source files
COPY src ./src

# Expose the application port
EXPOSE 80

# Set the entry point to run the application
ENTRYPOINT ["npm", "run", "start:ts"]