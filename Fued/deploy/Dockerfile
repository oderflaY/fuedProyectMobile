# Imagen de producción de Fued: la API (PHP) y la app web (Ionic ya compilada en www/) en un solo Apache.
#   /            -> app web (www/)
#   /fued-api/   -> API
# Se construye desde la raíz del proyecto: docker build -f deploy/Dockerfile .
FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql exif \
    && a2enmod rewrite headers \
    && sed -ri 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && printf 'upload_max_filesize = 16M\npost_max_size = 18M\nexpose_php = Off\n' > "$PHP_INI_DIR/conf.d/fued.ini" \
    && printf 'ServerTokens Prod\nServerSignature Off\n' > /etc/apache2/conf-enabled/fued.conf

COPY api/docker-entrypoint.sh /usr/local/bin/fued-entrypoint
RUN chmod +x /usr/local/bin/fued-entrypoint

COPY www/ /var/www/html/
COPY deploy/web.htaccess /var/www/html/.htaccess
COPY api/ /var/www/html/fued-api/

WORKDIR /var/www/html/fued-api
ENTRYPOINT ["fued-entrypoint"]
CMD ["apache2-foreground"]
