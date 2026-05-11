import torch
import torch.nn as nn
import torchvision.models as models
import math

# Default Sequence Length (Fallback)
SEQ_LEN = 30

def _build_resnet18(pretrained=True):
    m = models.resnet18(pretrained=pretrained)
    return nn.Sequential(*list(m.children())[:-1]), 512

def _build_mobilenet_v3_small(pretrained=True):
    m = models.mobilenet_v3_small(pretrained=pretrained)
    return nn.Sequential(m.features, nn.AdaptiveAvgPool2d(1)), 576

def _build_efficientnet_b0(pretrained=True):
    m = models.efficientnet_b0(pretrained=pretrained)
    return nn.Sequential(m.features, nn.AdaptiveAvgPool2d(1)), 1280

CNN_REGISTRY = {
    'resnet18'           : _build_resnet18,
    'mobilenet_v3_small' : _build_mobilenet_v3_small,
    'efficientnet_b0'    : _build_efficientnet_b0,
}

class ModalityFeatureExtractor(nn.Module):
    """
    forward(x: (B, C, H, W)) -> (B, feature_dim)
    """
    def __init__(self, cnn_name='resnet18', pretrained=True, freeze=False):
        super().__init__()
        if cnn_name not in CNN_REGISTRY:
            raise ValueError(f'Unknown CNN: {cnn_name}. Options: {list(CNN_REGISTRY)}')
        self.cnn_name = cnn_name
        self.conv_blocks, self.feature_dim = CNN_REGISTRY[cnn_name](pretrained)
        if freeze:
            for p in self.conv_blocks.parameters():
                p.requires_grad = False

    def forward(self, x):
        return self.conv_blocks(x).flatten(start_dim=1)

class _MLPHead(nn.Module):
    def __init__(self, feat_dim, seq_len, hidden=256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Flatten(),
            nn.Linear(seq_len * feat_dim, hidden),
            nn.BatchNorm1d(hidden), nn.ReLU(inplace=True), nn.Dropout(0.3),
            nn.Linear(hidden, 128), nn.ReLU(inplace=True),
            nn.Linear(128, 1),
        )
    def forward(self, x):  return self.net(x)

class _RNNHead(nn.Module):
    def __init__(self, feat_dim, rnn_type='lstm', hidden=256, num_layers=2):
        super().__init__()
        rnn_cls = nn.LSTM if rnn_type == 'lstm' else nn.GRU
        self.rnn = rnn_cls(
            input_size=feat_dim, hidden_size=hidden,
            num_layers=num_layers, batch_first=True,
            dropout=0.3 if num_layers > 1 else 0.0
        )
        self.classifier = nn.Sequential(
            nn.Linear(hidden, 128), nn.BatchNorm1d(128),
            nn.ReLU(inplace=True), nn.Dropout(0.3),
            nn.Linear(128, 1),
        )
    def forward(self, x):
        out, _ = self.rnn(x)
        return self.classifier(out[:, -1, :])

class _TransformerHead(nn.Module):
    def __init__(self, feat_dim, nhead=4, num_layers=2, hidden=256):
        super().__init__()
        self.d_model   = math.ceil(max(hidden, feat_dim) / nhead) * nhead
        self.proj      = nn.Linear(feat_dim, self.d_model)
        self.cls_token = nn.Parameter(torch.zeros(1, 1, self.d_model))
        enc = nn.TransformerEncoderLayer(
            d_model=self.d_model, nhead=nhead,
            dim_feedforward=self.d_model * 2, dropout=0.1, batch_first=True)
        self.encoder    = nn.TransformerEncoder(enc, num_layers=num_layers)
        self.classifier = nn.Sequential(
            nn.Linear(self.d_model, 128), nn.ReLU(inplace=True),
            nn.Dropout(0.3), nn.Linear(128, 1),
        )
    def forward(self, x):
        B  = x.size(0)
        x  = self.proj(x)
        x  = torch.cat([self.cls_token.expand(B, -1, -1), x], dim=1)
        x  = self.encoder(x)
        return self.classifier(x[:, 0, :])

class DeceptionTemporalModel(nn.Module):
    """
    CNN + temporal head for a single modality (face).
    forward(x: (B, S, C, H, W)) -> (B, 1)
    """
    def __init__(self, cnn_name='resnet18', head_type='lstm',
                 seq_len=None, hidden_dim=256, num_layers=2,
                 freeze_cnn=False, pretrained=True):
        super().__init__()
        self.cnn_name  = cnn_name
        self.head_type = head_type
        self.seq_len   = seq_len or SEQ_LEN
        self.extractor = ModalityFeatureExtractor(cnn_name, pretrained, freeze_cnn)
        D = self.extractor.feature_dim
        
        if   head_type == 'mlp':         self.head = _MLPHead(D, self.seq_len, hidden_dim)
        elif head_type == 'lstm':        self.head = _RNNHead(D, 'lstm', hidden_dim, num_layers)
        elif head_type == 'gru':         self.head = _RNNHead(D, 'gru',  hidden_dim, num_layers)
        elif head_type == 'transformer': self.head = _TransformerHead(D, hidden=hidden_dim)
        else: raise ValueError(f'Unknown head_type: {head_type}')

    def forward(self, x):
        B, S, C, H, W = x.size()
        feats = self.extractor(x.view(B * S, C, H, W)).view(B, S, -1)
        return self.head(feats)

class ArmsTemporalModel(nn.Module):
    """
    Early Fusion of Left and Right arm streams.
    forward(l_arm, r_arm) where each is (B, S, C, H, W) -> (B, 1)
    """
    def __init__(self, cnn_name='resnet18', head_type='lstm',
                 seq_len=None, hidden_dim=256, num_layers=2,
                 freeze_cnn=False, pretrained=True):
        super().__init__()
        self.cnn_name  = cnn_name
        self.head_type = head_type
        self.seq_len   = seq_len or SEQ_LEN

        self.extractor = ModalityFeatureExtractor(cnn_name, pretrained, freeze_cnn)
        self.pool      = nn.AdaptiveAvgPool2d(1)
        feat_dim       = self.extractor.feature_dim

        if head_type in ('lstm', 'gru'):
            rnn_cls = nn.LSTM if head_type == 'lstm' else nn.GRU
            self.rnn = rnn_cls(
                input_size=feat_dim, hidden_size=hidden_dim,
                num_layers=num_layers, batch_first=True,
                dropout=0.3 if num_layers > 1 else 0.0
            )
            self._head = 'rnn'
            enc_out_dim = hidden_dim

        elif head_type == 'transformer':
            d_model = math.ceil(max(hidden_dim, feat_dim) / 4) * 4
            self.tf_proj      = nn.Linear(feat_dim, d_model)
            self.tf_cls_token = nn.Parameter(torch.zeros(1, 1, d_model))
            enc_layer = nn.TransformerEncoderLayer(
                d_model=d_model, nhead=4,
                dim_feedforward=d_model * 2, dropout=0.1, batch_first=True)
            self.transformer = nn.TransformerEncoder(enc_layer, num_layers=2)
            self._head = 'transformer'
            enc_out_dim = d_model

        elif head_type == 'mlp':
            self.mlp_proj = nn.Sequential(
                nn.Linear(feat_dim, hidden_dim), nn.ReLU(inplace=True))
            self._head = 'mlp'
            enc_out_dim = hidden_dim
        else:
            raise ValueError(f'Unknown head_type: {head_type}')

        self.enc_out_dim = enc_out_dim

        # Early-Fusion MLP
        self.mlp = nn.Sequential(
            nn.Linear(enc_out_dim * 2, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(inplace=True),
            nn.Linear(128, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1),
        )

    def _extract(self, arm):
        B, S, C, H, W = arm.size()
        flat  = arm.view(B * S, C, H, W)
        feats = self.extractor(flat)
        return feats.view(B, S, -1)

    def _encode(self, feats):
        B = feats.size(0)
        if self._head == 'rnn':
            out, _ = self.rnn(feats)
            return out[:, -1, :] 
        elif self._head == 'transformer':
            x   = self.tf_proj(feats)
            cls = self.tf_cls_token.expand(B, -1, -1)
            x   = torch.cat([cls, x], dim=1)
            x   = self.transformer(x)
            return x[:, 0, :]
        else:
            return self.mlp_proj(feats).mean(dim=1)

    def forward(self, l_arm, r_arm):
        B, S, C, H, W = l_arm.size()
        l_feats = self._extract(l_arm)
        r_feats = self._extract(r_arm)
        l_enc = self._encode(l_feats)
        r_enc = self._encode(r_feats)

        fused = torch.cat([l_enc, r_enc], dim=-1)
        fused = fused.view(B, -1)
        return self.mlp(fused)


class MultimodalPipeline(nn.Module):
    """Thin wrapper that holds face + arms models and runs them together."""
    def __init__(self, face_net, arms_net):
        super().__init__()
        self.face_net = face_net
        self.arms_net = arms_net

    def forward(self, face, l_arm, r_arm):
        return self.face_net(face), self.arms_net(l_arm, r_arm)