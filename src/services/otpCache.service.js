class OtpCacheService {
  static #otpMap = new Map();

  static setOTP(id_usuario, codigo, expiresInMs = 5 * 60 * 1000) {
    const expiracion = Date.now() + expiresInMs;
    this.#otpMap.set(id_usuario, { codigo, expiracion });
  }

  static getOTP(id_usuario) {
    const data = this.#otpMap.get(id_usuario);
    if (!data) return null;

    if (Date.now() > data.expiracion) {
      this.#otpMap.delete(id_usuario);
      return null;
    }

    return data.codigo;
  }

  static deleteOTP(id_usuario) {
    this.#otpMap.delete(id_usuario);
  }
}

export default OtpCacheService;
