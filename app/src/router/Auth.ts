import { Elysia } from 'elysia'
import { Authcontroller } from '../Controller/Authcontroller'
import { afterhanlerUser } from '../middleware/Afterhanler'
export const Auths = (app: Elysia) => {
  return app.group('/auth', app => {
    app
      .post('/signin', Authcontroller.signin, { afterHandle: afterhanlerUser })
      .post('/signup', Authcontroller.signup)
    return app
  })
}