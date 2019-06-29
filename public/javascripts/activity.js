/*
THIS IS THE SUPPOSED WAY TO IMPLEMENT YT VIDEO IF THE IFRAME FAILS
var tag = document.createElement('script');

tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// 3. This function creates an <iframe> (and YouTube player)
//    after the API code downloads.
var player;
function onYouTubeIframeAPIReady() {
    player = new YT.Player('videoPlayer', {
        height: '563',
        width: '1000',
        videoId: 'M7lc1UVf-VE',
        // events: {
        //     'onReady': onPlayerReady //autoplay
        // }
    });
}

// 4. The API will call this function when the video player is ready.
function onPlayerReady(event) {
    event.target.playVideo();
}
*/