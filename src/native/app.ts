// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import { Capacitor } from '@capacitor/core';

/** True dentro l'app Android (Capacitor), false nel browser e nella PWA. */
export function inApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
