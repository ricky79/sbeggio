// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

package app.sbeggio;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Esportazioni dell'app Android. Nella WebView il download di un blob (<a download>) viene ignorato e la
 * Web Share API con i file non esiste, quindi il file si salva con la schermata "Salva con nome" di
 * sistema (ACTION_CREATE_DOCUMENT), che permette anche di sceglierlo su Drive. I file binari (Excel)
 * arrivano in base64 con codifica = "base64".
 */
@CapacitorPlugin(name = "File")
public class FilePlugin extends Plugin {

    @PluginMethod
    public void salva(PluginCall call) {
        String nome = call.getString("nome");
        String contenuto = call.getString("contenuto");
        if (nome == null || contenuto == null) {
            call.reject("nome e contenuto sono obbligatori");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("tipo", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, nome);
        startActivityForResult(call, intent, "fileScelto");
    }

    @ActivityCallback
    private void fileScelto(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() != null ? result.getData().getData() : null;
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            risolvi(call, false);
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IOException("impossibile aprire il file");
            out.write(dati(call));
            risolvi(call, true);
        } catch (IOException | SecurityException | IllegalArgumentException e) {
            call.reject("Salvataggio non riuscito: " + e.getMessage());
            getBridge().releaseCall(call);
        }
    }

    /** Il contenuto da scrivere: testo in UTF-8, oppure byte in base64 (file Excel) se codifica = "base64". */
    private static byte[] dati(PluginCall call) {
        String contenuto = call.getString("contenuto", "");
        if ("base64".equals(call.getString("codifica"))) return Base64.decode(contenuto, Base64.DEFAULT);
        return contenuto.getBytes(StandardCharsets.UTF_8);
    }

    private void risolvi(PluginCall call, boolean salvato) {
        JSObject risultato = new JSObject();
        risultato.put("salvato", salvato);
        call.resolve(risultato);
        getBridge().releaseCall(call);
    }
}
