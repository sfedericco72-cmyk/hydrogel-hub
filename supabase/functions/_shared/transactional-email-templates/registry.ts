/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as stockBajo } from './stock-bajo.tsx'
import { template as dispositivoDesconectado } from './dispositivo-desconectado.tsx'
import { template as emailNoConfigurado } from './email-no-configurado.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'stock-bajo': stockBajo,
  'dispositivo-desconectado': dispositivoDesconectado,
  'email-no-configurado': emailNoConfigurado,
}
