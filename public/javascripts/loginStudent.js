'use strict';
window.addEventListener('load',function(){
    document.getElementById('btiniciar').addEventListener('click', function(){
        let nombre = document.getElementById('txtusuario').value,
            pwd = document.getElementById('txtpass').value;
        
        if (nombre.length > 0 && pwd.length > 0){
            document.getElementById('forminicio').submit();
        }else{
            alert('Please fill in all the required fields');
        }
    });
});
