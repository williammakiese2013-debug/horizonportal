    (function(){
      // 1. Screen Orientation API (Chrome Android, Firefox)
      function lockLandscape(){
        var so = screen.orientation || screen.mozOrientation || screen.msOrientation;
        if(so && so.lock){
          so.lock('landscape').catch(function(){});
        } else if(screen.lockOrientation){
          screen.lockOrientation('landscape');
        } else if(screen.mozLockOrientation){
          screen.mozLockOrientation('landscape');
        } else if(screen.msLockOrientation){
          screen.msLockOrientation('landscape');
        }
      }
      // Tenter le lock dès que possible et après interaction utilisateur
      lockLandscape();
      document.addEventListener('click', lockLandscape, {once:true});
      document.addEventListener('touchstart', lockLandscape, {once:true});

      // 2. Fallback CSS : rotation forcée si portrait détecté
      //    On applique une rotation 90° à <html> en mode portrait
      function applyRotation(){
        if(window.innerHeight > window.innerWidth){
          // Portrait détecté → on pivote tout le viewport
          document.documentElement.style.transform = 'rotate(90deg)';
          document.documentElement.style.transformOrigin = 'center center';
          document.documentElement.style.width = window.innerHeight + 'px';
          document.documentElement.style.height = window.innerWidth + 'px';
          document.documentElement.style.position = 'fixed';
          document.documentElement.style.top = ((window.innerHeight - window.innerWidth) / 2) + 'px';
          document.documentElement.style.left = -((window.innerHeight - window.innerWidth) / 2) + 'px';
          document.documentElement.style.overflow = 'hidden';
        } else {
          // Paysage → on retire la rotation
          document.documentElement.style.transform = '';
          document.documentElement.style.transformOrigin = '';
          document.documentElement.style.width = '';
          document.documentElement.style.height = '';
          document.documentElement.style.position = '';
          document.documentElement.style.top = '';
          document.documentElement.style.left = '';
        }
      }
      applyRotation();
      window.addEventListener('resize', applyRotation);
      window.addEventListener('orientationchange', function(){
        setTimeout(applyRotation, 100);
      });
    })();
