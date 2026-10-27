# API de Fued en Apache + PHP. La publica docker-compose.yml en http://<ip>/fued-api
FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql exif \
    && a2enmod rewrite \
    && sed -ri 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf \
    && printf 'upload_max_filesize = 16M\npost_max_size = 18M\n' > /usr/local/etc/php/conf.d/fued.ini

COPY docker-entrypoint.sh /usr/local/bin/fued-entrypoint
RUN chmod +x /usr/local/bin/fued-entrypoint

WORKDIR /var/www/html/fued-api
ENTRYPOINT ["fued-entrypoint"]
CMD ["apache2-foreground"]
