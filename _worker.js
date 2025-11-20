export default {
    async fetch(request) {
      const url = new URL(request.url);
      
      if (url.pathname === '/sitemap.xml') {
        const response = await fetch(request);
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Content-Type', 'application/xml; charset=utf-8');
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }
      
      return fetch(request);
    }
  };