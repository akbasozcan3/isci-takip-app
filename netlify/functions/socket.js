// Netlify Functions Socket.IO desteği sınırlı
// Bu dosya placeholder - Socket.IO Netlify'da tam çalışmaz
// Railway.app kullanman önerilir

exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Socket.IO is not fully supported on Netlify Functions',
      recommendation: 'Use Railway.app for Socket.IO support'
    })
  };
};

