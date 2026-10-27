// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

package app.sbeggio;

import android.content.Intent;
import android.nfc.NfcAdapter;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // I plugin locali vanno registrati prima di super.onCreate.
        registerPlugin(NfcPlugin.class);
        registerPlugin(FilePlugin.class);
        // Activity ricreata dal sistema (es. cambio della dimensione dei caratteri): il tag dell'intent
        // di avvio è già stato timbrato e BridgeActivity.load() lo riconsegnerebbe.
        Intent intent = getIntent();
        if (savedInstanceState != null && intent != null && NfcAdapter.ACTION_NDEF_DISCOVERED.equals(intent.getAction())) {
            setIntent(new Intent(Intent.ACTION_MAIN));
        }
        super.onCreate(savedInstanceState);
        // Il suono del primo passaggio (tag NFC) parte prima di qualsiasi tocco: senza questo la WebView
        // lo bloccherebbe, perché di default l'audio richiede un gesto dell'utente.
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
    }
}
