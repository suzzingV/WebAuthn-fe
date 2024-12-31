const serverUrl = "http://localhost:8080"; // 스프링부트가 구동되는 URL

// 배열Buffer <-> Base64URL 변환 유틸 (간단 버전)
function bufferToBase64Url(buffer) {
  // ArrayBuffer -> Uint8Array
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  let base64 = btoa(binary);
  // base64 -> base64url
  base64 = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return base64;
}

function base64UrlToBuffer(base64url) {
  // base64url -> base64
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  // padding
  while(base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * (1) 등록 요청
 */
async function registerCredential() {
  const userId = "200";
  const res = await fetch(`${serverUrl}/webauthn/register/${userId}`, {
    method: "GET", // GET 요청
    headers: { "Content-Type": "application/json" }, // 요청 헤더 설정
    body: JSON.stringify({ userId }),
  });
  const options = await res.json();
  console.log("Server Response:", options);
  console.log("Decoded Challenge (ArrayBuffer):", base64UrlToBuffer(options.challenge));

  // 2. WebAuthn API가 요구하는 형식으로 변환
  const publicKeyOptions = {
    challenge: base64UrlToBuffer(options.challenge), // challenge를 ArrayBuffer로 변환
    rp: {
      name: options.rp, // 신뢰 당사자 정보
    },
    user: {
      id: base64UrlToBuffer(options.user.id.toString()), // user.id를 ArrayBuffer로 변환
      name: options.user.email, // 사용자 이메일
      displayName: options.user.name, // 사용자 이름
    },
    pubKeyCredParams: options.pubKeyCredParams.map(param => ({
      alg: param.alg, // 알고리즘 정보
      type: param.type, // public-key
    })),
    authenticatorSelection: {
      authenticatorAttachment: options.authenticatorAttachment, // Windows Hello와 같은 플랫폼 인증기를 사용
      requireResidentKey: options.requireResidentKey, // 사용자의 키 저장 요구 비활성화
      userVerification: options.userVerification, // 사용자 인증 필수
    },
  };

  console.log("WebAuthn PublicKey Options:", publicKeyOptions);

  // 3. WebAuthn API로 credential 생성
  let credential;
  try {
    credential = await navigator.credentials.create({ publicKey: publicKeyOptions });
    console.log("Credential:", credential);
  } catch (err) {
    console.error("Registration error:", err);
    document.getElementById("result").innerText = "등록 에러: " + err.message;
    return;
  }

  // 4. 서버에 credential 전달(등록 결과 저장)
  const credentialData = {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bufferToBase64Url(credential.response.attestationObject),
      clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
    },
  };

  const res2 = await fetch(`${serverUrl}/webauthn/register/${userId}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(credentialData),
  });

  const result = await res2.text();
  document.getElementById("result").innerText = "등록 결과: " + result;
}

/**
 * (2) 로그인(인증) 요청
 */
async function loginCredential() {
  // 1. 서버에서 PublicKeyCredentialRequestOptions 받아오기
  const res = await fetch(`${serverUrl}/auth/options`);
  const options = await res.json();

  // 2. ArrayBuffer로 변환
  options.publicKey.challenge = base64UrlToBuffer(options.publicKey.challenge);
  if (options.publicKey.allowCredentials) {
    options.publicKey.allowCredentials = options.publicKey.allowCredentials.map((cred) => {
      return {
        ...cred,
        id: base64UrlToBuffer(cred.id),
      };
    });
  }

  // 3. WebAuthn API로 credential 요청(로그인)
  let assertion;
  try {
    assertion = await navigator.credentials.get(options);
  } catch (err) {
    console.error("Login error:", err);
    document.getElementById("result").innerText = "로그인 에러: " + err;
    return;
  }

  // 4. 서버에 credential 전달(서명 검증)
  const assertionData = {
    id: assertion.id,
    rawId: bufferToBase64Url(assertion.rawId),
    type: assertion.type,
    response: {
      authenticatorData: bufferToBase64Url(assertion.response.authenticatorData),
      clientDataJSON: bufferToBase64Url(assertion.response.clientDataJSON),
      signature: bufferToBase64Url(assertion.response.signature),
      userHandle: assertion.response.userHandle
        ? bufferToBase64Url(assertion.response.userHandle)
        : null,
    },
  };

  const res2 = await fetch(`${serverUrl}/auth/response`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(assertionData),
  });
  const result = await res2.text();
  document.getElementById("result").innerText = "로그인 결과: " + result;
}


// 이벤트 바인딩
document.getElementById("registerBtn").addEventListener("click", registerCredential, () => {
  console.log("Register button clicked!"); // 버튼 클릭 시 로그 출력
  registerCredential();
});
document.getElementById("loginBtn").addEventListener("click", loginCredential);
