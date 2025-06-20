import { Elysia } from 'elysia'
import { Authcontroller } from '../Controller/Authcontroller'
import { beforeadmin } from '../middleware/onlyadmin'
export const middlewareadmin = (app: Elysia) => {
  return app.group('/middleware', app => {
    app
      .get("/admin",()=>{},{beforeHandle:beforeadmin})
    return app
  })
}