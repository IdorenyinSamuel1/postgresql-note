export function errorHandler(err, req, res, next) {
  console.error(err);

  if(err.code === 'P2002') {
    return res.status(400).json({ 
        success: false,
        message: 'A product with this sku already exists. Please use a different sku.'
     });
  }
  
  if(err.code === 'P2025') {
    return res.status(404).json({ 
        success: false,
        message: 'Product not found.'
     });
  }

//   if(error.code === 'P2003') {
//     return res.status(400).json({ 
//         success: false,
//         message: 'Invalid foreign key value. Please check the related data.'
//      });
//   }

  if(err.statusCode) {
    return res.status(err.statusCode).json({ 
        success: false,
        message: err.message
     });
  }

  return res.status(500).json({
    success: false,
    message: 'Internal Server Error',
  });   
}