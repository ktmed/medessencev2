FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy configuration files
COPY simple-nginx.conf /etc/nginx/nginx.conf

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl

# Create log directories
RUN mkdir -p /var/log/nginx

# Set proper permissions
RUN chown -R nginx:nginx /var/log/nginx
RUN chown -R nginx:nginx /etc/nginx/ssl

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]