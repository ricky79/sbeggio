// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { describe, expect, it } from 'vitest';
import { rilevatoreQrDisponibile } from '../src/ui/scanner';

/** Un BarcodeDetector finto con i formati indicati (o che fallisce). */
function rilevatore(formati: string[] | Error) {
  return class {
    static async getSupportedFormats(): Promise<string[]> {
      if (formati instanceof Error) throw formati;
      return formati;
    }
    async detect(): Promise<{ rawValue: string }[]> {
      return [];
    }
  };
}

describe('scelta del decodificatore QR', () => {
  it('usa BarcodeDetector solo se c\'è e legge i QR', async () => {
    expect(await rilevatoreQrDisponibile(rilevatore(['qr_code', 'ean_13']))).toBe(true);
    expect(await rilevatoreQrDisponibile(rilevatore(['ean_13']))).toBe(false);
    expect(await rilevatoreQrDisponibile(undefined)).toBe(false);
  });

  it('se BarcodeDetector fallisce ripiega su jsQR invece di bloccare lo scanner', async () => {
    expect(await rilevatoreQrDisponibile(rilevatore(new DOMException('x', 'NotSupportedError')))).toBe(false);
  });
});
