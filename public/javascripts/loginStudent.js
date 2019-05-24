'use strict';
window.addEventListener('load',function(){
    document.getElementById('btiniciar').addEventListener('click', function(){
        var nombre = document.getElementById('txtusuario').value;
        var pwd = document.getElementById('txtpass').value;
        
        var flag= false;
        
        if(nombre.length > 0 && pwd.length > 0){
            flag = true;
        }
        
        if(flag === true){
            document.getElementById('forminicio').submit();
        }else{
            alert('Please fill in all the required fields');
        }
    });
});
