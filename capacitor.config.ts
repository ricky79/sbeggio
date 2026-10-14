// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Riccardo Oliosi

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // L'id identifica l'app su Android e sul Play Store: dopo la pubblicazione non si può più cambiare.
  appId: 'app.sbeggio',
  appName: 'Sbeggio',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      iconColor: '#249a4c',
    },
  },
};

export default config;
