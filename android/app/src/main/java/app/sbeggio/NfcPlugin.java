// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

package app.sbeggio;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.nfc.NfcAdapter;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tag NFC di Sbeggio. Un tag con il solo URI sbeggio://timbra apre l'app (filtro NDEF_DISCOVERED nel
 * manifest) e qui diventa l'evento "tag" per il JavaScript, che decide cosa timbrare.
 */
@CapacitorPlugin(name = "Nfc")
public class NfcPlugin extends Plugin {

    static final String SCHEMA = "sbeggio";
    static final String HOST = "timbra";

    /** True per l'intent di un tag di Sbeggio, tranne quando l'app è riaperta dalle recenti. */
    static boolean eTagTimbra(Intent intent) {
        if (intent == null || !NfcAdapter.ACTION_NDEF_DISCOVERED.equals(intent.getAction())) return false;
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return false;
        Uri uri = intent.getData();
        return uri != null && SCHEMA.equals(uri.getScheme()) && HOST.equals(uri.getHost());
    }

    /**
     * Capacitor lo chiama sia all'avvio a freddo (BridgeActivity.load() → onNewIntent(getIntent()))
     * sia con l'app aperta (singleTask → onNewIntent). L'evento resta trattenuto finché il
     * JavaScript non registra il listener.
     */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (eTagTimbra(intent)) notifyListeners("tag", new JSObject(), true);
    }

    @PluginMethod
    public void stato(PluginCall call) {
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        JSObject risultato = new JSObject();
        risultato.put("disponibile", adapter != null);
        risultato.put("attivo", adapter != null && adapter.isEnabled());
        call.resolve(risultato);
    }

    @PluginMethod
    public void apriImpostazioniNfc(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_NFC_SETTINGS));
        } catch (ActivityNotFoundException e) {
            // Alcuni produttori non hanno la schermata NFC dedicata.
            getActivity().startActivity(new Intent(Settings.ACTION_WIRELESS_SETTINGS));
        }
        call.resolve();
    }

    @PluginMethod
    @SuppressWarnings("deprecation")
    public void vibra(PluginCall call) {
        Vibrator vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator != null && vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(150, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                vibrator.vibrate(150);
            }
        }
        call.resolve();
    }
}
