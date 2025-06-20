import type { Context } from 'elysia'
export interface User {
  username: string
  password: string
  email: string
  role: string
}


// ถ้าคุณมี store แบบนี้
export interface Store {
  decode?: {
    decode: {
      role: 'admin' | 'user' | 'kitchen'
      username: string
      email: string
      iat: number
    }
  }
}

// รวมทุกอย่างให้กลายเป็น AppContext
export type AppContext = Context & {
  store: Store,
  jwt: any,
  cookie: Context['cookie'],
  set: Context['set']
} 