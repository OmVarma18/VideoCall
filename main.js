let APP_ID = "c3d014a9878e4d63a307798d72465d8d";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');

if (!roomId) {
    window.location = 'lobby.html';
}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
};

let constraints = {
    video: {
        width: { min: 640, ideal: 1920, max: 1920 },
        height: { min: 480, ideal: 1080, max: 1080 },
    },
    audio: true
};

let init = async () => {
    try {
        client = await AgoraRTM.createInstance(APP_ID);
        await client.login({ uid, token });

        channel = client.createChannel(roomId);
        await channel.join();

        channel.on('MemberJoined', handleUserJoined);
        channel.on('MemberLeft', handleUserLeft);

        client.on('MessageFromPeer', handleMessageFromPeer);

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('user-1').srcObject = localStream;
        document.getElementById('user-1').classList.add('flipHorizontal');

    } catch (error) {
        console.error('Error initializing: ', error);
    }
};

let handleUserLeft = (MemberId) => {
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');
};

let handleMessageFromPeer = async (message, MemberId) => {
    try {
        message = JSON.parse(message.text);

        if (message.type === 'offer') {
            createAnswer(MemberId, message.offer);
        }

        if (message.type === 'answer') {
            addAnswer(message.answer);
        }

        if (message.type === 'candidate') {
            if (peerConnection) {
                await peerConnection.addIceCandidate(message.candidate);
            }
        }
    } catch (error) {
        console.error('Error handling message from peer: ', error);
    }
};

let handleUserJoined = async (MemberId) => {
    console.log('A new user joined the channel:', MemberId);
    createOffer(MemberId);
};

let createPeerConnection = async (MemberId) => {
    try {
        peerConnection = new RTCPeerConnection(servers);

        remoteStream = new MediaStream();
        document.getElementById('user-2').srcObject = remoteStream;
        document.getElementById('user-2').style.display = 'block';

        document.getElementById('user-1').classList.add('smallFrame');

        if (!localStream) {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            document.getElementById('user-1').srcObject = localStream;
        }

        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
        };

        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId);
            }
        };
    } catch (error) {
        console.error('Error creating peer connection: ', error);
    }
};

let createOffer = async (MemberId) => {
    try {
        await createPeerConnection(MemberId);

        let offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer }) }, MemberId);
    } catch (error) {
        console.error('Error creating offer: ', error);
    }
};

let createAnswer = async (MemberId, offer) => {
    try {
        await createPeerConnection(MemberId);

        await peerConnection.setRemoteDescription(offer);

        let answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId);
    } catch (error) {
        console.error('Error creating answer: ', error);
    }
};

let addAnswer = async (answer) => {
    try {
        if (!peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(answer);
        }
    } catch (error) {
        console.error('Error adding answer: ', error);
    }
};

let leaveChannel = async () => {
    try {
        await channel.leave();
        await client.logout();
    } catch (error) {
        console.error('Error leaving channel: ', error);
    }
};

let toggleCamera = async () => {
    try {
        let videoTrack = localStream.getTracks().find(track => track.kind === 'video');

        if (videoTrack.enabled) {
            videoTrack.enabled = false;
            document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)';
        } else {
            videoTrack.enabled = true;
            document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)';
        }
    } catch (error) {
        console.error('Error toggling camera: ', error);
    }
};

let toggleMic = async () => {
    try {
        let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');

        if (audioTrack.enabled) {
            audioTrack.enabled = false;
            document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)';
        } else {
            audioTrack.enabled = true;
            document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)';
        }
    } catch (error) {
        console.error('Error toggling microphone: ', error);
    }
};

window.addEventListener('beforeunload', leaveChannel);

document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);

init();
