<?php
declare(strict_types=1);

// Endpoint público para paramédicos que escanean la tarjeta RFID.
// Por norma de seguridad siempre devuelve `perfilEmergenciaReducido`: alergias,
// condiciones críticas, medicación de rescate y tipo de sangre no son ocultables.
// El paciente puede ampliar el escaneo con otras secciones desde sus preferencias
// de privacidad, pero nunca reducirlo por debajo de ese mínimo vital.
return function (Router $r): void {
    $r->get('/emergencia/rfid/{idTarjeta}', function (array $p): void {
        $tarjeta = DispositivoRfid::buscarOFallar($p['idTarjeta'], 'tarjeta_no_encontrada', 'La tarjeta no está registrada.');
        if (!$tarjeta->estaActiva()) {
            throw new HttpError(410, 'tarjeta_revocada', 'La tarjeta fue reportada como extraviada o dada de baja.');
        }
        $paciente = $tarjeta->paciente;
        if ($paciente === null) {
            throw new HttpError(404, 'paciente_no_encontrado', 'La tarjeta no tiene un paciente asociado.');
        }
        responder($paciente->perfilEmergenciaPara());
    });
};
