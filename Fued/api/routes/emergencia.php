<?php
declare(strict_types=1);

// Endpoint público para paramédicos que escanean la tarjeta RFID.
// Por norma de seguridad sólo devuelve `perfilEmergenciaReducido`.
return function (Router $r): void {
    $r->get('/emergencia/rfid/{idTarjeta}', function (array $p): void {
        $tarjeta = DispositivoRfid::buscarOFallar($p['idTarjeta'], 'tarjeta_no_encontrada', 'La tarjeta no está registrada.');
        if (!$tarjeta->estaActiva()) {
            throw new HttpError(410, 'tarjeta_revocada', 'La tarjeta fue reportada como extraviada o dada de baja.');
        }
        $paciente = $tarjeta->paciente;
        responder(['perfilEmergenciaReducido' => $paciente?->perfilEmergencia()]);
    });
};
